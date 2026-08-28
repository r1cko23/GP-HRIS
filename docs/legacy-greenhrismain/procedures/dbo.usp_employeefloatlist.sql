-- =============================================
-- Author:		Pats Relos
-- Create date: <7-30-2023>
-- Description:	<Payroll Summary Per Client>
-- =============================================
CREATE PROCEDURE [dbo].[usp_employeefloatlist]
@filtertext7 varchar(100)
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

    
);


CREATE INDEX idx_employeeid ON #TempTable (employeeid)
CREATE INDEX idx_noofdays ON #TempTable (noofdays);
CREATE INDEX idx_lastpayrol ON #TempTable (lastpayroll);
CREATE INDEX idx_department ON #TempTable (departmentname);
CREATE INDEX idx_clientname ON #TempTable (companyname);



INSERT INTO #TempTable (idclient,employeeid,fname,lname,mname,employementtype,status,gender,companyname,departmentname,datehired)
SELECT
    Employee.idclient,
    Employee.Employee_id,
    Employee.fname,
    Employee.lname,
    Employee.mname,
    Employee.employee_status,
    Employee.status,
    Employee.sex,
    client.companyname,
    Department.Department_desc,
	employee.datehired

FROM Employee
INNER JOIN client
    ON Employee.idclient = client.idclient
INNER JOIN Department
    ON Employee.department_code = Department.iddepartment
WHERE Employee.employee_status = 'Float';

UPDATE       #TempTable
SET                lastpayroll = View_lastpayroll.Lastpayroll
FROM            View_lastpayroll INNER JOIN
                         #TempTable ON View_lastpayroll.Employee_id = #TempTable.Employeeid

UPDATE #TempTable
SET noofdays = CASE
                  WHEN lastpayroll IS NULL THEN NULL
                  ELSE DATEDIFF(DAY, lastpayroll, GETDATE())
               END;
                         

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
WHERE
    ISNULL(@filtertext7, '') = ''
    OR fname LIKE '%' + @filtertext7 + '%'
    OR lname LIKE '%' + @filtertext7 + '%'
    OR mname LIKE '%' + @filtertext7 + '%'
    OR companyname LIKE '%' + @filtertext7 + '%'
    OR departmentname LIKE '%' + @filtertext7 + '%';



-- Remember to drop the temporary table when you no longer need it
DROP TABLE #TempTable;

END

