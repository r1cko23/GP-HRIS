-- =============================================
-- Author:		Pats Relos
-- Create date: <7-30-2023>
-- Description:	<Payroll Summary Per Client>
-- =============================================
CREATE PROCEDURE [dbo].[usp_employeeinactivelist]
 @filtertext3 nvarchar(100)
--@payrollmonth varchar(20),
--@clientstatus varchar(8),
--@dstart date,
--@dend date


AS	

BEGIN

	SET NOCOUNT ON;

CREATE TABLE #TempTable (
    [ID] INT IDENTITY(1, 1) PRIMARY KEY,
    
	[idclient] int,
	employeeid int,
	fname nvarchar(50), 
	lname nvarchar(50), 
	mname nvarchar(50), 
	lastpayroll date,
	noofdays int,
	employementtype nvarchar(20), 
	status nvarchar(15),
	gender nvarchar(20),
	companyname nvarchar(100),
	departmentname  nvarchar(100),
	datehired date,
	statusremarks  nvarchar(255),


    
);


CREATE INDEX idx_employeeid ON #TempTable (employeeid)
CREATE INDEX idx_noofdays ON #TempTable (noofdays);
CREATE INDEX idx_lastpayrol ON #TempTable (lastpayroll);
CREATE INDEX idx_department ON #TempTable (departmentname);
CREATE INDEX idx_clientname ON #TempTable (companyname);



INSERT INTO #TempTable (idclient,employeeid,fname,lname,mname,employementtype,status,gender,companyname,departmentname,datehired,statusremarks)

SELECT
    e.idclient,
    e.Employee_id,
    e.fname,
    e.lname,
    e.mname,
    e.employee_status,
    e.status,
    e.sex,
    c.companyname,
    d.Department_desc,
	e.datehired,
	e.statusremarks
FROM Employee AS e
INNER JOIN client AS c
    ON e.idclient = c.idclient
INNER JOIN Department AS d
    ON e.department_code = d.iddepartment
WHERE e.status = 'InActive'
  AND (
        e.finalpaystatus IS NULL
        OR e.finalpaystatus NOT IN ('Release','For Release', 'Claimed', 'Barred')
      );

UPDATE       #TempTable
SET                lastpayroll = View_lastpayroll.Lastpayroll
FROM            View_lastpayroll INNER JOIN
                         #TempTable ON View_lastpayroll.Employee_id = #TempTable.Employeeid

UPDATE #TempTable
SET noofdays = CASE
                  WHEN lastpayroll IS NULL THEN NULL
                  ELSE DATEDIFF(DAY, lastpayroll, GETDATE())
               END;
                         

--------------

SELECT 
    employeeid,
    fname,
    lname,
    mname,
    lastpayroll,
    noofdays,
    employementtype,
    status,
    gender,
    companyname,
    departmentname,
	datehired,
	statusremarks
FROM #TempTable
WHERE(
        ISNULL(@filtertext3, '') = ''
        OR fname LIKE '%' + @filtertext3 + '%'
        OR lname LIKE '%' + @filtertext3 + '%'
        OR mname LIKE '%' + @filtertext3 + '%'
        OR companyname LIKE '%' + @filtertext3 + '%'
        OR departmentname LIKE '%' + @filtertext3 + '%'
    )
	order by noofdays desc



--where noofdays <=90

-- Remember to drop the temporary table when you no longer need it
DROP TABLE #TempTable;

END

