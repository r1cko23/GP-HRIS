-- =============================================
-- Author:		Pats Relos
-- Create date: <7-30-2023>
-- Description:	<Payroll Summary Per Client>
-- =============================================
CREATE PROCEDURE [dbo].[usp_employeeactivelist]
@filtertext2 varchar(100), 
@buttonpress2 nvarchar(30)
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
	statusremarks  nvarchar(255),
	datehired date

    
);


CREATE INDEX idx_employeeid ON #TempTable (employeeid)
CREATE INDEX idx_noofdays ON #TempTable (noofdays);
CREATE INDEX idx_lastpayrol ON #TempTable (lastpayroll);
CREATE INDEX idx_department ON #TempTable (departmentname);
CREATE INDEX idx_clientname ON #TempTable (companyname);


INSERT INTO #TempTable (idclient,employeeid,fname,lname,mname,employementtype,status,gender,companyname,departmentname,datehired)

SELECT
    E.idclient,
    E.Employee_id,
    E.fname,
    E.lname,
    E.mname,
    E.employee_status,
    E.status,
    E.sex,
    C.companyname,
    D.Department_desc,
	e.datehired

FROM Employee AS E
INNER JOIN Client AS C
    ON E.idclient = C.idclient
INNER JOIN Department AS D
    ON E.department_code = D.iddepartment
WHERE
    e.status = 'Active'
    AND e.employee_status <> 'On Leave' and e.employee_status <>'Float';

UPDATE       #TempTable
SET                lastpayroll = View_lastpayroll.Lastpayroll
FROM            View_lastpayroll INNER JOIN
                         #TempTable ON View_lastpayroll.Employee_id = #TempTable.Employeeid

UPDATE #TempTable
SET noofdays = CASE
                  WHEN lastpayroll IS NULL THEN NULL
                  ELSE DATEDIFF(DAY, lastpayroll, GETDATE())
               END;



                         

SET @filtertext2 = ISNULL(@filtertext2, '') 
IF @buttonpress2 = 'excel2'
BEGIN
    SELECT 
        employeeid AS [Employee ID],
        fname AS [First Name],
        mname AS [Middle Name],
        lname AS [Last Name],
        gender AS [Gender],
        companyname AS [Client Name],
        departmentname AS [Department Group],
        lastpayroll AS [Last Payroll],
        noofdays AS [No of Days],
        employementtype AS [Employee Type],
        status AS [Status]
        --statusremarks AS [Remarks]
        --newstatus,
        --newtype,
        --verifiedforverification,
        --datehired
    FROM #TempTable
    WHERE noofdays <= 130
      AND (
            @filtertext2 = ''
            OR fname LIKE '%' + @filtertext2 + '%'
            OR lname LIKE '%' + @filtertext2 + '%'
            OR mname LIKE '%' + @filtertext2 + '%'
            OR companyname LIKE '%' + @filtertext2 + '%'
            OR departmentname LIKE '%' + @filtertext2 + '%'
          )
		  order by departmentname;
END


else 
BEGIN 

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
	datehired
FROM #TempTable
WHERE noofdays <= 130
AND (
        ISNULL(@filtertext2, '') = ''
        OR fname LIKE '%' + @filtertext2 + '%'
        OR lname LIKE '%' + @filtertext2 + '%'
        OR mname LIKE '%' + @filtertext2 + '%'
        OR companyname LIKE '%' + @filtertext2 + '%'
        OR departmentname LIKE '%' + @filtertext2 + '%'
    )
	order by noofdays desc;
END
-- Remember to drop the temporary table when you no longer need it
DROP TABLE #TempTable;


END
