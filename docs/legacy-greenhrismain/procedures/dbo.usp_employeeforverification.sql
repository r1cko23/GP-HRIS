-- =============================================
-- Author:		Pats Relos
-- Create date: <7-30-2023>
-- Description:	<Payroll Summary Per Client>
-- =============================================
CREATE PROCEDURE [dbo].[usp_employeeforverification]


@filtertext varchar(100), 
@buttonpress nvarchar(30)
--@payrollmonth varchar(20),
--@clientstatus varchar(8),
--@dstart date,
--@dend date

AS	

BEGIN

	SET NOCOUNT ON;

CREATE TABLE #TempTable 
(
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
	newstatus nvarchar(30),
	newtype nvarchar(30),
	verifiedforverification nvarchar(1),
	datehired date



    
);


CREATE INDEX idx_employeeid ON #TempTable (employeeid)
CREATE INDEX idx_noofdays ON #TempTable (noofdays);
CREATE INDEX idx_lastpayrol ON #TempTable (lastpayroll);
CREATE INDEX idx_department ON #TempTable (departmentname);
CREATE INDEX idx_clientname ON #TempTable (companyname);



INSERT INTO #TempTable (idclient,employeeid,fname,lname,mname,employementtype,status,gender,companyname,departmentname,statusremarks,newstatus, newtype, verifiedforverification,datehired)

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
    Employee.statusremarks,
    Employee.newstatus,
    Employee.newtype,
    Employee.verifiedforverification,
	Employee.datehired
FROM Employee
INNER JOIN client
    ON Employee.idclient = client.idclient
INNER JOIN Department
    ON Employee.department_code = Department.iddepartment
WHERE Employee.status = 'Active'
  AND Employee.employee_status NOT IN ('Float', 'On Leave');

UPDATE       #TempTable
SET                lastpayroll = View_lastpayroll.Lastpayroll
FROM            View_lastpayroll INNER JOIN
                         #TempTable ON View_lastpayroll.Employee_id = #TempTable.Employeeid

UPDATE #TempTable
SET noofdays = CASE
                  WHEN lastpayroll IS NULL THEN NULL
                  ELSE DATEDIFF(DAY, lastpayroll, GETDATE())
               END;
 


SET @filtertext = ISNULL(@filtertext, '');

IF @buttonpress = 'excel'
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
        status AS [Status],
        statusremarks AS [Remarks]
        --newstatus,
        --newtype,
        --verifiedforverification,
        --datehired
    FROM #TempTable
    WHERE noofdays > 130
      AND (
            @filtertext = ''
            OR fname LIKE '%' + @filtertext + '%'
            OR lname LIKE '%' + @filtertext + '%'
            OR mname LIKE '%' + @filtertext + '%'
            OR companyname LIKE '%' + @filtertext + '%'
            OR departmentname LIKE '%' + @filtertext + '%'
          );
END
ELSE
BEGIN
    SELECT 
        employeeid,
        fname,
        mname,
        lname,
        gender,
        companyname,
        departmentname,
        lastpayroll,
        noofdays,
        employementtype,
        status,
        statusremarks,
        newstatus,
        newtype,
        verifiedforverification,
        datehired
    FROM #TempTable
    WHERE noofdays > 130
      AND (
            @filtertext = ''
            OR fname LIKE '%' + @filtertext + '%'
            OR lname LIKE '%' + @filtertext + '%'
            OR mname LIKE '%' + @filtertext + '%'
            OR companyname LIKE '%' + @filtertext + '%'
            OR departmentname LIKE '%' + @filtertext + '%'
          );
END








DROP TABLE #TempTable;

END

