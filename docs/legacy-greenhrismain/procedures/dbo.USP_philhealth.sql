-- =============================================
-- Author:		<Pat Relos
-- Create date: <1-16-2024>
-- Description:	<SSS Complex>
-- =============================================
CREATE PROCEDURE [dbo].[USP_philhealth]
@payrollmonth nvarchar(30),
@idclient int,
@departmentcodep int,
@idclientbranchp int

--@payoutdate nvarchar(20),
--@iddepartmentx int
AS	

BEGIN

--constant value for testing 
--DECLARE @idclient int =157
--DECLARE @payrollmonth nvarchar(20) ='November 2023'
--declare @departmentcodep int =213

declare @idclientlast int
declare @departmentcodeplast int
declare @branchcodelast int
declare @idclientbranchlast int
declare @idemployeePHI int



SET NOCOUNT ON;
 

CREATE TABLE #TempTablePHI(
    [ID] INT IDENTITY(1, 1) PRIMARY KEY,
    [idpayrollsum] int,
	[Employee_id] int,
	[lname] NVARCHAR(50),
	[fname] NVARCHAR(50),
	[mname] NVARCHAR(50),
	[basisofsssded] NVARCHAR(20),
	[idclient] int,
	[idclientp] int,
	[monthyear] NVARCHAR(20),
	[departmentcodep] int, 
	[idclientbranchp] int, 
	[grossamttaxable] float, 
	[contributionPHIEE] float,
	[contributionPHIER] float,
	[Adjustment] float, 
	[lastbasic] float,
	[philhealthno] NVARCHAR(30),
	[birthdate] NVARCHAR(20),
	[datehired]	NVARCHAR(20)
	
   );

-- Insert data from the payroll_summary table into the #TempTable
CREATE INDEX idx_empid ON #TempTablePHI (Employee_id);
CREATE INDEX idx_idpayrollsum ON #TempTablePHI (idpayrollsum);
CREATE INDEX idx_monthyear ON #TempTablePHI (monthyear);
CREATE INDEX idx_lname ON #TempTablePHI (lname);
CREATE INDEX idx_clientp ON #TempTablePHI (idclientp);


INSERT INTO #TempTablePHI (employee_id,idpayrollsum,lname,fname,mname,basisofsssded,idclient,idclientp,idclientbranchp,monthyear,departmentcodep,grossamttaxable,contributionPHIEE,contributionPHIER,Adjustment,lastbasic,PHIlhealthno,birthdate,datehired)
		
SELECT        employee_id, idpayrollsum, lname, fname,  mname, basisofsssded,idclient,idclientp,idclientbranchp, payrollmonth,department_codep,grossamttaxable,contributionphilhealthEE,contributionphilhealthER,Adjustment,lastbasic,PHIlhealthno, FORMAT(date_Birth, 'MM/dd/yyyy') AS date_Birth,FORMAT(datehired, 'MM/dd/yyyy') AS date_hired
FROM          FORPHILHEALTH
where payrollmonth = @payrollmonth
order by lname,fname


---SET get last idclient 
DECLARE myCursor2 CURSOR FOR

	SELECT employee_id FROM #TempTablePHI where monthyear=@payrollmonth and idclientp <> @idclient
	OPEN myCursor2
   
   FETCH NEXT FROM myCursor2 INTO @idemployeePHI
	WHILE @@FETCH_STATUS = 0
	
	BEGIN
		--get last idclientp,department and branch
		 SELECT TOP 1  @idclientlast =  idclientp FROM #TempTablePHI where Employee_id = @idemployeePHI and monthyear = @payrollmonth and  contributionPHIEE <>0  order by idpayrollsum desc
		 SELECT TOP 1  @departmentcodeplast =  departmentcodep FROM #TempTablePHI where Employee_id = @idemployeePHI and monthyear = @payrollmonth and  contributionPHIEE <>0  order by idpayrollsum desc
		 SELECT TOP 1  @idclientbranchlast =  idclientbranchp FROM #TempTablePHI where Employee_id = @idemployeePHI and monthyear = @payrollmonth and  contributionPHIEE <>0  order by idpayrollsum desc


		--update 
		update #TempTablePHI
		set idclientp = @idclientlast,
		departmentcodep = @departmentcodeplast,
		idclientbranchp = @idclientbranchlast		
		Where Employee_id = @idemployeePHI


		FETCH NEXT FROM myCursor2 INTO @idemployeePHI
	END
	CLOSE myCursor2
	DEALLOCATE myCursor2    
	   	 
-- Retrieve data from #TempTable
--SELECT * FROM #TempTableSSS  
--where idclientp = @idclient
--order by lname



--SELECT        #TempTablePHI.*, client.companyname,Department.Department_desc,client_branch.branch
--FROM            #TempTablePHI 
--                         INNER JOIN client ON #TempTablePHI.idclientp = client.idclient
--						 INNER JOIN Department ON #TempTablePHI.departmentcodep = Department.iddepartment
--						 INNER JOIN client_branch ON #TempTablePHI.idclientbranchp = client_branch.idclientbranch						 
--						 where  (@idclient = 0 OR idclientp = @idclient)
--						 AND (@departmentcodep IS NULL OR departmentcodep = @departmentcodep OR @departmentcodep = 0)
--						 AND (@idclientbranchp IS NULL OR idclientbranchp = @idclientbranchp OR @idclientbranchp = 0)
--						 order by lname,fname asc;


SELECT      sum(#TempTablephi.contributionPHIEE) as contributionphiee, 
			sum(#TempTablephi.contributionPHIER) as contributionphier , 
			sum(#TempTablephi.grossamttaxable) as grosstaxableamt,
			sum(#TempTablephi.lastbasic) as lastbasic1,
			#TempTablePHI.Employee_id,#TempTablePHI.fname,#TempTablePHI.lname,#TempTablePHI.mname,#TempTablePHI.monthyear,#TempTablePHI.basisofsssded,#TempTablePHI.idclient,#TempTablePHI.departmentcodep,#TempTablePHI.monthyear,companyname, Department.Department_desc,client_branch.branch,#TempTablePHI.philhealthno,birthdate,datehired
FROM            #TempTablePHI 
                         INNER JOIN client ON #TempTablePHI.idclientp = client.idclient
						 INNER JOIN Department ON #TempTablePHI.departmentcodep = Department.iddepartment
						 INNER JOIN client_branch ON #TempTablePHI.idclientbranchp = client_branch.idclientbranch						 
						 where  (@idclient = 0 OR idclientp = @idclient)
						 AND (@departmentcodep IS NULL OR departmentcodep = @departmentcodep OR @departmentcodep = 0)
						 AND (@idclientbranchp IS NULL OR idclientbranchp = @idclientbranchp OR @idclientbranchp = 0)
						 
			group by #TempTablePHI.Employee_id, #TempTablePHI.fname,#TempTablePHI.lname,#TempTablePHI.mname,#TempTablePHI.monthyear,#TempTablePHI.basisofsssded,#TempTablePHI.idclient,#TempTablePHI.departmentcodep,#TempTablePHI.monthyear,companyname,Department.Department_desc,client_branch.branch,#TempTablePHI.philhealthno,birthdate,datehired
			HAVING (sum(#TempTablePHI.contributionPHIEE) <> 0)
			order by lname,fname asc;




--select empid from #TempTable3 where departmentgroup = 'KRR_ Bacoor Junction'
--group by empid

-- Remember to drop the temporary table when you no longer need it
DROP TABLE #TempTablePHI;


END

