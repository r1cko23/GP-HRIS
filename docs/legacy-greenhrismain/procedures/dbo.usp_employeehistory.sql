-- =============================================
-- Author:		Pats Relos
-- Create date: <7-30-2023>
-- Description:	<Payroll Summary Per Client>
-- =============================================
CREATE PROCEDURE [dbo].[usp_employeehistory]
@employeeid int
--@filtertext2 varchar(100) 
--@payrollmonth varchar(20),
--@clientstatus varchar(8),
--@dstart date,
--@dend date


AS	

BEGIN

	SET NOCOUNT ON;

CREATE TABLE #TempTable (
    [ID] INT IDENTITY(1, 1) PRIMARY KEY,
	idpayrollsum int,	    
	[idclient] int,
	employeeid int,
	fname nvarchar(50), 
	lname nvarchar(50), 
	mname nvarchar(50), 
	datestart nvarchar(20), 
	dateend nvarchar(20),
	payrolldate nvarchar(20), 
	clientname nvarchar(100), 
	departmentname nvarchar(100), 
	jobposition nvarchar(100), 
	dailyrate float,
	grossamount float,
	netamount float,


	

    
);


CREATE INDEX idx_employeeid ON #TempTable (employeeid)


INSERT INTO #TempTable (idpayrollsum,idclient,employeeid,fname,lname,mname,datestart,dateend,payrolldate,clientname,departmentname,jobposition,dailyrate,grossamount,netamount)
SELECT     
p.idpayrollsum
,e.idclient
, e.Employee_id
, e.fname
, e.lname
, e.mname
, p.Date_Start
, p.Date_End
, p.payrolldate
, p.companyname2
, p.departmentdesc2
, p.jobposition2
, p.dailyrate_payroll
, p.grossalary
, p.netamount

FROM            Employee AS e 
				INNER JOIN payroll_summary AS p ON E.Employee_id = P.Employee_id
WHERE        (E.Employee_id = @employeeid)


INSERT INTO #TempTable
(
	idpayrollsum,
    idclient,
    employeeid,
    fname,
    lname,
    mname,
    datestart,
    dateend,
    payrolldate, 
	clientname,
	departmentname,
	jobposition,
	dailyrate,
	grossamount,
	netamount

)
SELECT
	p.idpayrollsum,
    e.idclient,
    e.Employee_id,
    e.fname,
    e.lname,
    e.mname,
    p.Date_Start,
    p.Date_End,
    p.payrolldate, 
	p.companyname, 
	p.departmentdesc,
	p.jobposition,
	p.dailyrate_payroll,
	p.grossalary,
	p.netamount

FROM Employee AS e
INNER JOIN payrollhistory.dbo.payroll_history AS p
    ON e.Employee_id = p.Employee_id
WHERE e.Employee_id = @employeeid
  AND NOT EXISTS
  (
      SELECT 1
      FROM #TempTable t
      WHERE t.idpayrollsum = p.idpayrollsum
  );
	 	 





                        

--------------

SELECT 
    employeeid,
    fname,
    lname,
    mname, 
	datestart,
	dateend,
	payrolldate, 
	clientname, 
	departmentname,
	jobposition,
	dailyrate,
	grossamount,
	netamount

	
FROM #TempTable
WHERE employeeid =@employeeid
order by payrolldate asc
	

-- Remember to drop the temporary table when you no longer need it
DROP TABLE #TempTable;

END

